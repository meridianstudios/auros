// Loopback helper for native Google sign-in.
//
// The in-webview Google popup can't work (Google blocks OAuth in embedded
// webviews, and the gapi iframe is CORS-blocked on the tauri:// origin). So we
// do the desktop OAuth dance: open Google in the system browser with a redirect
// to http://127.0.0.1:<port>, catch the redirect here, and hand the query
// (?code=…&state=…) back to the frontend, which finishes the exchange + signs
// into Firebase. The frontend opens the browser, so this just binds a port and
// waits for the one redirect.

use std::io::{ErrorKind, Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

// A few candidate ports; whichever is free gets used. Register all of these as
// authorized redirect URIs on the Google OAuth client.
const PORTS: [u16; 3] = [8765, 8766, 8767];
const TIMEOUT_SECS: u64 = 180;

#[derive(Clone, serde::Serialize)]
struct OauthPayload {
    query: Option<String>,
    error: Option<String>,
}

fn emit(app: &AppHandle, query: Option<String>, error: Option<String>) {
    let _ = app.emit("auros://oauth", OauthPayload { query, error });
}

#[tauri::command]
pub fn start_google_oauth(app: AppHandle) -> Result<u16, String> {
    let (listener, port) = PORTS
        .iter()
        .find_map(|&p| TcpListener::bind(("127.0.0.1", p)).ok().map(|l| (l, p)))
        .ok_or_else(|| format!("Sign-in needs a free local port ({}–{}), but they're all in use.", PORTS[0], PORTS[PORTS.len() - 1]))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(TIMEOUT_SECS);
        loop {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let target = req
                        .lines()
                        .next()
                        .and_then(|l| l.split_whitespace().nth(1))
                        .unwrap_or("/")
                        .to_string();

                    let html = "<!doctype html><meta charset=utf-8><title>Auros</title>\
<body style=\"margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0B1020;color:#E7ECF5;display:grid;place-items:center;height:100vh\">\
<div style=\"text-align:center\"><div style=\"font-size:44px\">\u{26A1}</div>\
<h2 style=\"margin:.4em 0 .2em\">Signed in to Auros</h2>\
<p style=\"color:#9aa4b5;margin:0\">You can close this tab and return to the app.</p></div>";
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        html.len(),
                        html
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    let _ = stream.flush();

                    let query = target.split_once('?').map(|(_, q)| q.to_string());
                    emit(&app, query, None);
                    break;
                }
                Err(ref e) if e.kind() == ErrorKind::WouldBlock => {
                    if Instant::now() > deadline {
                        emit(&app, None, Some("Sign-in timed out.".into()));
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(120));
                }
                Err(e) => {
                    emit(&app, None, Some(e.to_string()));
                    break;
                }
            }
        }
    });

    Ok(port)
}

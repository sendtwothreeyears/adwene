use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

pub struct SidecarState {
    child: Mutex<Option<Child>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("Failed to resolve project root")
}

pub fn start_sidecar(state: &SidecarState) {
    // Kill any orphaned sidecar still holding the port from a previous run
    let _ = Command::new("sh")
        .args(["-c", "lsof -ti :8765 | xargs kill -9 2>/dev/null"])
        .status();

    let root = project_root();
    let sidecar_dir = root.join("sidecar");

    println!("[sidecar] Starting Python sidecar...");

    let mut child = match Command::new("uv")
        .args(["run", "python", "-m", "src.server"])
        .current_dir(&sidecar_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("[sidecar] Failed to start: {e}");
            return;
        }
    };

    println!("[sidecar] Sidecar started (PID: {})", child.id());

    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                println!("[sidecar stdout] {}", line);
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                eprintln!("[sidecar stderr] {}", line);
            }
        });
    }

    *state.child.lock().unwrap() = Some(child);
}

pub fn stop_sidecar(state: &SidecarState) {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        println!("[sidecar] Stopping sidecar (PID: {})...", child.id());
        let _ = child.kill();
        let _ = child.wait();
        println!("[sidecar] Sidecar stopped");
    }
}

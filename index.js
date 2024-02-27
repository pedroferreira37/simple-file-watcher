import fs from "fs";
import { spawn, exec } from "child_process";

function buf_match(prev, cur) {
  if (prev.length !== cur.length) return false;

  for (let i = 0; i < prev; i++) {
    if (prev[i] !== cur[i]) return false;
  }

  return true;
}

function watch_file(path, cb) {
  const bufs = {};
  const tick_time = 10;
  let child = null;

  function watch() {
    const cur_buf = fs.readFileSync(path);
    const current_mf_time = Date.now();

    if (!bufs[path]) {
      bufs[path] = {
        prev: null,
        cur: { data: cur_buf, modified_time: current_mf_time },
      };
    } else {
      const buf = bufs[path];
      buf.prev = buf.cur;
      buf.cur = { data: cur_buf, modified_time: current_mf_time };

      if (!buf_match(buf.prev.data, buf.cur.data)) {
        if (child) {
          child.kill("SIGTERM");
          exec(`kill ${child.pid}`);
        }

        child = exec(`node ${path}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Command stderr: ${stderr}`);
            return;
          }
          console.log(stdout);
        });

        child.on("exit", (code, signal) => {
          console.log(
            `Child process exited with code ${code} and signal ${signal}`
          );
          child = null;
        });

        if (cb) {
          cb({ time: buf.prev.modified_time }, { time: current_mf_time });
        }
      }
    }
  }

  watch();
  setInterval(watch, tick_time);
}

watch_file("test.js");

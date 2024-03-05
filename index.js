import fs from "fs";
import { EventEmitter } from "events";
import util from "util";

const stat = util.promisify(fs.stat);
const tasks = new Map();

const register = (main, prop, listener) =>
  (main[prop] = new Set(
    main[prop] instanceof Set ? main[prop] : [main[prop]]
  ).add(listener));

const walk = (val, fn) => (val instanceof Set ? val.forEach(fn) : fn(val));

const isFileModified = (curr, prev) => {
  const currmTime = curr.mtimeMs;
  return curr.size !== prev.size || currmTime > prev.mtimeMs || currmTime === 0;
};

const createTask = (path, listener, notifier) => {
  const task = {
    listeners: listener,
    notifiers: notifier,
    watcher: fs.watchFile(path, (curr, prev) => {
      walk(task.notifiers, (notifier) => notifier("changed file"));

      if (isFileModified(curr, prev)) {
        walk(task.listeners, (listener) => listener(path, curr));
      }
    }),
  };

  return task;
};

function watchFile(path, { listener, notifier }) {
  const task = tasks.get(path);

  if (task) {
    register(task, "listeners", listener);
    register(task, "notifiers", notifier);
  } else {
    tasks.set(path, createTask(path, listener, notifier));
  }
}

function watcherApi(bus) {
  const watch = (path, listener) => {
    let closer;

    closer = watchFile(path, {
      listener,
      notifier: (ev, payload) => bus.emit(ev, payload),
    });

    return closer;
  };

  const monitor = (file, stats) => {
    let prevStats = stats;

    const listener = async (path, newStats) => {
      try {
        const newStats = await stat(file);
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;

        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          bus.emit("change", file);
        }
      } catch (error) {
        console.log(error);
      }
    };

    watch(file, listener);
  };

  const add = async (path) => {
    const stats = await stat(path);

    if (stats.isFile()) monitor(path, stats);
  };

  return {
    add,
  };
}

function watch() {
  const dirs = [];

  const cwd = process.cwd();
  if (!dirs.length) dirs.unshift(`${cwd}/teste.js`);

  const bus = new EventEmitter();
  const api = watcherApi(bus);

  dirs.forEach((dir) => api.add(dir));

  return bus;
}

watch().on("change", (file) => {
  console.log("file changed: ", file);
});

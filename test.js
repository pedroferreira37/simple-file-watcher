import http from "http";

function greet(greeting) {
  return function (name) {
    return `${greeting} ${name}`;
  };
}

http
  .createServer((req, res) => console.log())
  .listen(3000, () => console.log("Server is running"));

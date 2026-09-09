import WebSocket from "ws";

const socket = new WebSocket("ws://localhost:8765");
socket.on("open", () => socket.send(JSON.stringify({ type: "mock_physical_tamper" })));
socket.on("message", (message) => {
  if (message.toString().includes("TAMPER_OPEN_EVENT")) {
    console.log("Mock Physical BlueBox tamper event sent");
    socket.close();
  }
});
socket.on("error", (error) => { console.error(`Mock tamper error: ${error.message}`); process.exit(1); });

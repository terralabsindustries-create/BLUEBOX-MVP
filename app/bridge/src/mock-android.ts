import WebSocket from "ws";

const socket = new WebSocket("ws://localhost:8765");
const speeds = [72, 78, 82, 87, 91, 94];
let index = 0;

socket.on("open", () => {
  console.log("Mock Android Vehicle Simulator connected");
  setInterval(() => {
    socket.send(JSON.stringify({ type: "android_telemetry", telemetry: { speedKph: speeds[index++ % speeds.length], roadLimitKph: 80, gnssStatus: "VALID", m2mNetwork: "ONLINE" } }));
  }, 1500);
});

socket.on("error", (error) => { console.error(`Mock Android error: ${error.message}`); process.exit(1); });

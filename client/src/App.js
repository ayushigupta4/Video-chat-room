import { useEffect } from "react";
import {  io } from "socket.io-client";

function App() {
  useEffect(() => {
    const socket = io("http://localhost:3001");

    socket.on("connect", () => {
      console.log("Connected to signaling server:", socket.id);
    });

    return () => socket.disconnected();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Video Chat Room</h1>
      <p>Frontend connected to backend successfully.</p>
    </div>
  )
}

export default App;

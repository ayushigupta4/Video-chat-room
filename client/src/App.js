import { useEffect, useRef, useState } from "react";

function App() {
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);

  const [remoteUsers, setRemoteUsers] = useState([]);

  function createPeer(remoteUserId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // Add local tracks
  localStreamRef.current.getTracks().forEach(track => {
    pc.addTrack(track, localStreamRef.current);
  });

  // Remote stream handling
  pc.ontrack = (event) => {
    const remoteVideo = document.getElementById(`video-${remoteUserId}`);
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // ICE handling
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socketRef.current.send(JSON.stringify({
        type: "ice-candidate",
        targetId: remoteUserId,
        candidate: event.candidate,
      }));
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected") {
      pc.close();
      delete peersRef.current[remoteUserId];
    }
  };

  return pc;
}


  useEffect(() => {
    async function init() {
      // 1. Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;

      // 2. WebSocket
      socketRef.current = new WebSocket("ws://localhost:3001");

      socketRef.current.onopen = () => {
        socketRef.current.send(JSON.stringify({
          type: "join-room",
          roomId: "test-room",
        }));
      };

      socketRef.current.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        // Existing users (YOU are new → do nothing)
        if (data.type === "existing-users") {
          setRemoteUsers(data.users);
        }

        // Someone joined AFTER you → YOU create offer
        if (data.type === "new-user") {
          const pc = createPeer(data.userId);
          peersRef.current[data.userId] = pc;

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socketRef.current.send(JSON.stringify({
            type: "offer",
            targetId: data.userId,
            offer,
          }));
        }

        // You received offer → create answer
        if (data.type === "offer") {
          const pc = createPeer(data.senderId);
          peersRef.current[data.senderId] = pc;

          setRemoteUsers(prev => [...new Set([...prev, data.senderId])]);

          await pc.setRemoteDescription(data.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socketRef.current.send(JSON.stringify({
            type: "answer",
            targetId: data.senderId,
            answer,
          }));
        }

        // You receive answer → ONLY if you created offer
        if (data.type === "answer") {
          const pc = peersRef.current[data.senderId];

          if (pc?.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(data.answer);
          }
        }

        // ICE
        if (data.type === "ice-candidate") {
          const pc = peersRef.current[data.senderId];
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(data.candidate);
          }
        }

        // User left
        if (data.type === "user-left") {
          const pc = peersRef.current[data.userId];
          if (pc) {
            pc.close();
            delete peersRef.current[data.userId];
          }
          setRemoteUsers(prev => prev.filter(id => id !== data.userId));
        }
      };
    }

    init();
  }, []);

  return (
    <div>
      <h2>Video Chat</h2>

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{ width: 300, border: "1px solid black" }}
      />

      <div style={{ display: "flex", gap: 10 }}>
        {remoteUsers.map(id => (
          <video
            key={id}
            id={`video-${id}`}
            autoPlay
            playsInline
            style={{ width: 300, border: "1px solid black" }}
          />
        ))}
      </div>
    </div>
  );
}

export default App;

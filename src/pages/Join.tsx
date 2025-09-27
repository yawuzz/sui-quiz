import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Join(){
  const nav = useNavigate();
  const [roomCode, setRoom] = useState("");
  const [name, setName] = useState("");

  return (
    <div style={{maxWidth:480, margin:"80px auto", padding:16}}>
      <h1>Join a Room</h1>
      <input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={{width:"100%", marginTop:8}}/>
      <input placeholder="Room code" value={roomCode} onChange={e=>setRoom(e.target.value.toUpperCase())} style={{width:"100%", marginTop:8}}/>
      <button disabled={!name || !roomCode} onClick={()=> nav(`/play/${roomCode}?name=${encodeURIComponent(name)}`)} style={{marginTop:8}}>Join</button>
      <p style={{marginTop:16}}>Are you a host? <a href="/host">Go to Host</a></p>
    </div>
  );
}

import { useLocation, useParams } from "react-router-dom";

export default function Leaderboard(){
  const { state } = useLocation() as any;
  const { roomCode } = useParams();
  const leaderboard = state?.leaderboard || [];
  const tx = state?.suiTxDigest;

  return (
    <div style={{maxWidth:700, margin:"24px auto", padding:16}}>
      <h2>Final Leaderboard — Room {roomCode}</h2>
      {tx && <p>On-chain Tx: <code>{tx}</code></p>}
      <ol>
        {leaderboard.map((p:any)=> <li key={p.playerId || p.id}>{p.name} — {p.score}</li>)}
      </ol>
      <p style={{marginTop:12}}><a href="/">Back to Home</a></p>
    </div>
  );
}


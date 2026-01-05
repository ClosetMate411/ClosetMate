import React from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const Home = () => {
  const navigate = useNavigate();
  
  return (
    <main className="home-container">
      <div className="main-header">Welcome to ClosetMate</div>
      <div className="main-sub-heading">
        Your smart wardrobe companion — simple, effortless
        clothing management.
      </div>
      <div className="main-description">
        ClosetMate helps you digitize and organize your wardrobe by
        transforming your clothing into a clean, visual collection. Upload
        images of your clothes, remove backgrounds automatically, and manage
        your items in one place — all through a simple and intuitive
        interface.
      </div>
      
      <button onClick={() => navigate('/wardrobe')}>Go To Wardrobe</button>
    </main>
  );
};

export default Home;

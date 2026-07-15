"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, SwitchCamera, VideoOff } from "lucide-react";

export default function RemoteMobilePage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access denied or unavailable", err);
        setError("Camera access is required for Remote Mobile Capture. Please allow permissions.");
      }
    }
    initCamera();

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Set up video ref when stream becomes available (if not caught in initial effect)
  useEffect(() => {
    if (videoRef.current && stream && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-bold tracking-wider text-pink-500">LUMORA<span className="text-white">REMOTE</span></h1>
        <div className="flex items-center space-x-2 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Connected to Laptop</span>
        </div>
      </div>

      {/* Camera Feed */}
      <div className="relative flex-1 bg-zinc-900 flex items-center justify-center">
        {error ? (
          <div className="text-center p-8 space-y-4">
            <VideoOff size={48} className="mx-auto text-red-500" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        ) : (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect for front camera
          />
        )}

        {/* Overlay Instructions */}
        {!error && (
          <div className="absolute bottom-32 left-0 w-full text-center z-20">
            <p className="text-white/80 bg-black/50 inline-block px-4 py-2 rounded-full backdrop-blur-sm text-sm">
              Look at the camera! Operator controls the capture.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 w-full p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center items-center z-50">
        <button className="p-4 bg-slate-800/80 backdrop-blur-md rounded-full text-white hover:bg-slate-700 transition-colors mx-4">
          <SwitchCamera size={28} />
        </button>
        
        {/* Shutter Button (Optional: PRD says guest can trigger capture or retake) */}
        <button className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/20">
          <div className="w-16 h-16 bg-pink-500 rounded-full"></div>
        </button>
      </div>
    </div>
  );
}

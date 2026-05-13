"use client";

import React from "react";

export function MapSkeleton() {
  return (
    <div className="absolute inset-0 bg-[#f4f1ea] overflow-hidden">
      {/* Subtle map-like grid pattern with desert tones */}
      <div 
        className="absolute inset-0 opacity-[0.05]" 
        style={{
          backgroundImage: `linear-gradient(#d4c4a8 1px, transparent 1px), linear-gradient(90deg, #d4c4a8 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Warm desert gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#ede9dd] via-transparent to-[#fdfbf7] opacity-60" />

      
      {/* Animated pulsing "markers" */}
      <div className="absolute inset-0">
        {[
          { top: '25%', left: '30%', delay: '0s' },
          { top: '40%', left: '70%', delay: '0.2s' },
          { top: '60%', left: '40%', delay: '0.4s' },
          { top: '20%', left: '80%', delay: '0.6s' },
          { top: '75%', left: '20%', delay: '0.8s' },
        ].map((pos, i) => (
          <div 
            key={i}
            className="absolute flex flex-col items-center animate-pulse"
            style={{ 
              top: pos.top, 
              left: pos.left,
              animationDelay: pos.delay 
            }}
          >
            <div className="size-10 rounded-full bg-muted shadow-sm" />
            <div className="mt-2 h-1 w-3 rounded-full bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Navigation controls skeleton */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <div className="size-10 rounded-lg bg-white/80 shadow-sm backdrop-blur-sm animate-pulse" />
        <div className="size-10 rounded-lg bg-white/80 shadow-sm backdrop-blur-sm animate-pulse" />
      </div>

      {/* Loading indicator in the center - subtle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Initializing
          </span>
        </div>
      </div>
    </div>
  );
}

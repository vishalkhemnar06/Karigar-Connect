// Splash.jsx
import React, { useEffect } from 'react';
import logo from '../assets/logo.jpg';

const Splash = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/home';
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden relative flex flex-col items-center justify-center p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Shapes */}
        <div className="absolute w-24 h-24 bg-orange-200/40 rounded-full top-1/4 left-1/6 animate-float-1"></div>
        <div className="absolute w-20 h-20 bg-amber-200/30 rounded-full top-1/3 right-1/5 animate-float-2"></div>
        <div className="absolute w-28 h-28 bg-yellow-100/40 rounded-full bottom-1/4 left-1/3 animate-float-3"></div>
        <div className="absolute w-16 h-16 bg-orange-300/20 rounded-full bottom-1/3 right-1/4 animate-float-4"></div>
        
        {/* Moving Lines */}
        <div className="absolute top-1/4 left-0 w-full h-0.5 bg-orange-200/30 animate-move-line-1"></div>
        <div className="absolute top-1/2 right-0 w-0.5 h-32 bg-amber-200/30 animate-move-line-2"></div>
        <div className="absolute bottom-1/3 left-0 w-full h-0.5 bg-orange-200/30 animate-move-line-3"></div>

        {/* Pulsing Rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 border border-orange-200/20 rounded-full animate-pulse-ring-1"></div>
          <div className="absolute w-80 h-80 border border-amber-200/15 rounded-full animate-pulse-ring-2"></div>
        </div>
      </div>

      {/* Sparkle Effects */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-orange-400/60 rounded-full animate-sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`
            }}
          ></div>
        ))}
      </div>

      {/* Main Content - Directly on Background */}
      <div className="relative z-20 text-center max-w-sm w-full animate-card-enter">
        
        {/* Logo with Multiple Animations */}
        <div className="mb-8">
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-300 to-amber-300 shadow-lg flex items-center justify-center border-4 border-white/80 animate-logo-spin">
            <div className="w-22 h-22 rounded-full bg-white/90 flex items-center justify-center shadow-inner">
              <img 
                src={logo} 
                alt="KarigarConnect Logo" 
                className="w-16 h-16 object-contain rounded-full animate-logo-bounce"
              />
            </div>
          </div>
          
          {/* Company Name with Glow Effect */}
          <h1 className="text-4xl font-black text-orange-800 mb-4 tracking-tight animate-typewriter glow-text">
            KarigarConnect
          </h1>
        </div>

        {/* Tagline with Staggered Words */}
        <p className="text-xl font-medium text-orange-700/90 mb-8 leading-relaxed">
          <span className="animate-word-fade-1 inline-block">Connecting</span>{' '}
          <span className="animate-word-fade-2 inline-block text-amber-700">Artisans</span>{' '}
          <span className="animate-word-fade-3 inline-block">with</span>{' '}
          <span className="animate-word-fade-4 inline-block text-orange-600">Opportunities</span>
        </p>

        {/* Feature Icons */}
        <div className="flex justify-center space-x-4 mb-8 animate-fade-in-up animation-delay-1500">
          {['🛠️', '🎨', '⭐', '🤝'].map((icon, index) => (
            <div
              key={index}
              className="w-12 h-12 bg-white/50 backdrop-blur-sm rounded-xl flex items-center justify-center border border-orange-200/50 shadow-sm animate-bounce-slow"
              style={{ animationDelay: `${1500 + index * 200}ms` }}
            >
              <span className="text-xl">{icon}</span>
            </div>
          ))}
        </div>

        {/* Animated Loading Bar */}
        <div className="mb-6">
          <div className="h-1.5 bg-white/40 rounded-full overflow-hidden mb-2 backdrop-blur-sm">
            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full animate-loading-bar shadow-md"></div>
          </div>
          <div className="flex justify-between text-sm text-orange-700/80">
            <span className="animate-text-fade font-medium">Loading your journey...</span>
            <span className="text-orange-600 font-semibold animate-pulse">3s</span>
          </div>
        </div>

        {/* Animated Dots */}
        <div className="flex justify-center space-x-1 mb-4">
          {[1, 2, 3].map((dot) => (
            <div
              key={dot}
              className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce-dots"
              style={{ animationDelay: `${dot * 0.3}s` }}
            ></div>
          ))}
        </div>

        {/* Subtle Footer */}
        <p className="text-orange-600/70 text-sm animate-text-glow font-medium">
          Crafting Dreams into Reality
        </p>
      </div>

      {/* Custom Styles */}
      <style>{`
        /* Card Entrance */
        @keyframes card-enter {
          0% {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Logo Animations */
        @keyframes logo-spin {
          0% {
            transform: rotate(0deg) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: rotate(180deg) scale(1.05);
          }
          100% {
            transform: rotate(360deg) scale(1);
            opacity: 1;
          }
        }

        @keyframes logo-bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        /* Typing Effect */
        @keyframes typewriter {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        /* Glow Text Effect */
        @keyframes text-glow {
          0%, 100% {
            text-shadow: 0 0 20px rgba(255, 165, 0, 0.3);
          }
          50% {
            text-shadow: 0 0 30px rgba(255, 165, 0, 0.6);
          }
        }

        /* Word Fade Effects */
        @keyframes word-fade-1 {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes word-fade-2 {
          0% { opacity: 0; transform: translateY(15px); }
          30% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes word-fade-3 {
          0% { opacity: 0; transform: translateY(15px); }
          50% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes word-fade-4 {
          0% { opacity: 0; transform: translateY(15px); }
          70% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* Floating Animations */
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(25px, -20px) rotate(3deg); }
          66% { transform: translate(-15px, 15px) rotate(-3deg); }
        }

        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-20px, -25px) rotate(-2deg); }
          66% { transform: translate(20px, 20px) rotate(2deg); }
        }

        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -15px) rotate(4deg); }
          66% { transform: translate(-25px, 25px) rotate(-4deg); }
        }

        @keyframes float-4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-30px, -30px) rotate(-5deg); }
          66% { transform: translate(25px, 20px) rotate(5deg); }
        }

        /* Moving Lines */
        @keyframes move-line-1 {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes move-line-2 {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        @keyframes move-line-3 {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }

        /* Pulsing Rings */
        @keyframes pulse-ring-1 {
          0% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.1;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
        }

        @keyframes pulse-ring-2 {
          0% {
            transform: scale(0.9);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.05;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.2;
          }
        }

        /* Loading Bar */
        @keyframes loading-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        /* Sparkle Effects */
        @keyframes sparkle {
          0% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
          }
          100% {
            opacity: 0;
            transform: scale(0) rotate(360deg);
          }
        }

        /* Bouncing Animations */
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes bounce-dots {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        /* Text Effects */
        @keyframes text-fade {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Animation Classes */
        .animate-card-enter {
          animation: card-enter 1.2s ease-out forwards;
        }

        .animate-logo-spin {
          animation: logo-spin 2s ease-out forwards;
        }

        .animate-logo-bounce {
          animation: logo-bounce 2s ease-in-out infinite;
        }

        .animate-typewriter {
          overflow: hidden;
          white-space: nowrap;
          margin: 0 auto;
          animation: typewriter 1.8s ease-in-out forwards;
        }

        .glow-text {
          animation: text-glow 3s ease-in-out infinite;
        }

        .animate-word-fade-1 {
          animation: word-fade-1 1.2s ease-out forwards;
        }

        .animate-word-fade-2 {
          animation: word-fade-2 1.5s ease-out forwards;
        }

        .animate-word-fade-3 {
          animation: word-fade-3 1.8s ease-out forwards;
        }

        .animate-word-fade-4 {
          animation: word-fade-4 2.1s ease-out forwards;
        }

        .animate-float-1 {
          animation: float-1 10s infinite ease-in-out;
        }

        .animate-float-2 {
          animation: float-2 12s infinite ease-in-out;
          animation-delay: 1s;
        }

        .animate-float-3 {
          animation: float-3 14s infinite ease-in-out;
          animation-delay: 2s;
        }

        .animate-float-4 {
          animation: float-4 11s infinite ease-in-out;
          animation-delay: 3s;
        }

        .animate-move-line-1 {
          animation: move-line-1 6s linear infinite;
        }

        .animate-move-line-2 {
          animation: move-line-2 5s linear infinite;
          animation-delay: 1s;
        }

        .animate-move-line-3 {
          animation: move-line-3 7s linear infinite;
          animation-delay: 2s;
        }

        .animate-pulse-ring-1 {
          animation: pulse-ring-1 4s ease-in-out infinite;
        }

        .animate-pulse-ring-2 {
          animation: pulse-ring-2 5s ease-in-out infinite;
          animation-delay: 1s;
        }

        .animate-loading-bar {
          animation: loading-bar 3s ease-in-out forwards;
        }

        .animate-sparkle {
          animation: sparkle 2.5s infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2.5s infinite ease-in-out;
        }

        .animate-bounce-dots {
          animation: bounce-dots 1.8s infinite ease-in-out;
        }

        .animate-text-fade {
          animation: text-fade 1s ease-out forwards;
          animation-delay: 0.8s;
          opacity: 0;
        }

        .animate-text-glow {
          animation: text-glow 2.5s ease-in-out infinite;
        }

        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out forwards;
          opacity: 0;
        }

        .animation-delay-1500 {
          animation-delay: 1.5s;
        }
      `}</style>
    </div>
  );
};

export default Splash;
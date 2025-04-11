import React from 'react';
import { Volleyball } from 'lucide-react'; // Corrected icon name back to Football

const Header: React.FC = () => {
  return (
    <header className="w-full bg-brand-dark shadow-md py-3 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-center md:justify-start">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Volleyball className="w-8 h-8 text-white" /> {/* Use the corrected icon */}
          {/* Title - Hidden on mobile (screens smaller than md), visible otherwise */}
          <h1 className="hidden md:block text-xl md:text-2xl font-bold text-white">
            EA FC Random Match Generator
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;

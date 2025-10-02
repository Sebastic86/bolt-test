import React, { useState } from 'react';
import { Volleyball, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserInfo, AuthenticatedOnly } from './RoleBasedComponents';

const Header: React.FC = () => {
  const { signOut, isAuthenticated, user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="w-full bg-brand-dark shadow-md py-3 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Volleyball className="w-8 h-8 text-white" />
          {/* Title - Hidden on mobile (screens smaller than md), visible otherwise */}
          <h1 className="hidden md:block text-xl md:text-2xl font-bold text-white">
            EA FC Random Match Generator
          </h1>
        </div>

        {/* Authentication Controls */}
        <AuthenticatedOnly>
          <div className="flex items-center space-x-4">
            {/* Desktop User Info */}
            <div className="hidden md:block">
              <UserInfo />
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 rounded-md p-2"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">{user?.email}</span>
                {showUserMenu ? (
                  <X className="w-4 h-4 md:hidden" />
                ) : (
                  <Menu className="w-4 h-4 md:hidden" />
                )}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  {/* Mobile User Info */}
                  <div className="md:hidden px-4 py-2 border-b border-gray-200">
                    <UserInfo />
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </AuthenticatedOnly>
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default Header;

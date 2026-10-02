import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Volleyball, LogOut, User, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserInfo, AuthenticatedOnly, AdminOnly } from './RoleBasedComponents';

const Header: React.FC = () => {
  const { signOut, user } = useAuth();
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
    <header className="relative flex h-14 flex-none items-center justify-between border-b-[3px] border-(--color-green-bright) bg-(--color-ink) px-4">
      <Link to="/" className="flex items-center gap-2 text-white">
        <Volleyball className="h-5 w-5" />
        <span className="text-base font-black uppercase tracking-wider">EA FC Generator</span>
      </Link>

      <AuthenticatedOnly>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-8 w-8 items-center justify-center bg-(--color-green-bright) text-sm font-black text-(--color-ink) focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="Open account menu"
          >
            {user?.email ? user.email.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 z-50 mt-2 w-56 border-2 border-(--color-ink) bg-white py-1 shadow-hard">
              <div className="border-b border-gray-200 px-4 py-2">
                <UserInfo />
              </div>

              <AdminOnly>
                <Link
                  to="/admin"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Dashboard</span>
                </Link>
              </AdminOnly>

              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </AuthenticatedOnly>

      {showUserMenu && (
        <button
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setShowUserMenu(false)}
          aria-label="Close menu"
          tabIndex={-1}
        />
      )}
    </header>
  );
};

export default Header;

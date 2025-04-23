import { useState, useEffect } from 'react';
import './App.css';
import Auth from '../../src/components/Auth/Auth';
import NoteSaver from '../../src/components/NoteSaver/NoteSaver';

function App() {
  const [user, setUser] = useState<{ email: string; uid: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const { user } = await browser.storage.local.get('user');
        if (user) {
          setUser(user);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  const handleLogin = (userData: { email: string; uid: string }) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (isLoading) {
    return <div className="loading dark">Loading...</div>;
  }

  return (
    <div className="app-container dark">
      {user ? (
        <NoteSaver user={user} onLogout={handleLogout} />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;

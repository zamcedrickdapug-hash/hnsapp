import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
	const [currentUser, setCurrentUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		// Subscribe to auth state changes
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			try {
				setCurrentUser(user);
				setError(null);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}, (error) => {
			setError(error.message);
			setLoading(false);
		});

		// Unsubscribe on unmount
		return unsubscribe;
	}, []);

	const logout = async () => {
		try {
			await signOut(auth);
			setCurrentUser(null);
		} catch (err) {
			setError(err.message);
			throw err;
		}
	};

	const value = {
		currentUser,
		loading,
		error,
		logout,
		isAuthenticated: !!currentUser,
		isEmailVerified: currentUser?.emailVerified || false,
	};

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}

import { Component } from 'react'

class ErrorBoundary extends Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false, error: null, errorInfo: null }
	}

	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	componentDidCatch(error, errorInfo) {
		console.error('[ErrorBoundary] Caught error:', error)
		console.error('[ErrorBoundary] Error info:', errorInfo)
		this.setState({
			error,
			errorInfo,
		})
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={styles.container}>
					<div style={styles.card}>
						<h2 style={styles.title}>Something went wrong</h2>
						<p style={styles.message}>
							An error occurred. Please try refreshing the page or logging out and back in.
						</p>
						{this.state.error && (
							<details style={styles.details}>
								<summary style={styles.summary}>Error details</summary>
								<pre style={styles.errorText}>{this.state.error.toString()}</pre>
								{this.state.errorInfo && (
									<pre style={styles.errorText}>{this.state.errorInfo.componentStack}</pre>
								)}
							</details>
						)}
						<button
							onClick={() => window.location.reload()}
							style={styles.button}
						>
							Refresh Page
						</button>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}

const styles = {
	container: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		minHeight: '100vh',
		backgroundColor: '#f5f5f5',
		padding: '20px',
	},
	card: {
		backgroundColor: 'white',
		borderRadius: '8px',
		boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
		padding: '40px',
		maxWidth: '600px',
		textAlign: 'center',
	},
	title: {
		fontSize: '24px',
		fontWeight: 'bold',
		marginBottom: '16px',
		color: '#333',
	},
	message: {
		fontSize: '16px',
		color: '#666',
		marginBottom: '24px',
		lineHeight: '1.5',
	},
	details: {
		marginBottom: '24px',
		textAlign: 'left',
		backgroundColor: '#f9f9f9',
		padding: '16px',
		borderRadius: '4px',
		border: '1px solid #ddd',
	},
	summary: {
		cursor: 'pointer',
		fontWeight: 'bold',
		color: '#0066cc',
	},
	errorText: {
		marginTop: '8px',
		fontSize: '12px',
		overflow: 'auto',
		backgroundColor: '#fff',
		padding: '8px',
		borderRadius: '4px',
		color: '#d32f2f',
	},
	button: {
		backgroundColor: '#0066cc',
		color: 'white',
		border: 'none',
		padding: '10px 24px',
		borderRadius: '4px',
		fontSize: '16px',
		cursor: 'pointer',
		transition: 'background-color 0.2s',
	},
}

export default ErrorBoundary

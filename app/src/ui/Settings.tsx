import './App.css'

function Settings() {
  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f8f9fa',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      margin: 0,
      padding: 0
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e9ecef',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.5rem', 
          color: '#212529',
          fontWeight: 600
        }}>
          Tether Settings
        </h1>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          padding: '3rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#e9ecef',
            borderRadius: '50%',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            ⚙️
          </div>
          
          <h2 style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: '1.25rem', 
            color: '#495057',
            fontWeight: 500
          }}>
            Settings Panel
          </h2>
          
          <p style={{ 
            margin: '0 0 1.5rem 0', 
            color: '#6c757d',
            lineHeight: 1.5
          }}>
            Configure your Tether experience. Settings options will be available here soon.
          </p>

          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            fontSize: '0.875rem',
            color: '#6c757d'
          }}>
            Coming soon: Activity monitoring preferences, notification settings, and more!
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings 
// Simple test to check API endpoints
async function testAPI() {
  try {
    console.log('Testing ping endpoint...');
    const pingResponse = await fetch('http://localhost:8080/api/ping');
    const pingData = await pingResponse.text();
    console.log('Ping response:', pingData);

    console.log('\nTesting download endpoint...');
    const downloadResponse = await fetch('http://localhost:8080/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        format: 'mp3-320'
      })
    });
    
    console.log('Download status:', downloadResponse.status);
    console.log('Download headers:', Object.fromEntries(downloadResponse.headers));
    
    if (downloadResponse.ok) {
      console.log('Download successful!');
    } else {
      const errorText = await downloadResponse.text();
      console.log('Download error:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI();
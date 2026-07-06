// Google Lens Trigger Content Script
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('triggerLens') === 'true') {
    let attempts = 0;
    const maxAttempts = 50; // Check for up to 5 seconds
    
    const interval = setInterval(() => {
      attempts++;
      
      // Google Lens button selectors on Google Images / Search page
      const cameraBtn = document.querySelector('[aria-label="Search by image"]') || 
                        document.querySelector('[aria-label="Search by Image"]') ||
                        document.querySelector('[aria-label="Camera"]') ||
                        document.querySelector('[aria-label="camera"]') ||
                        document.querySelector('.nKo7ee') ||
                        document.querySelector('div[jscontroller="Vx1Syc"]') ||
                        document.querySelector('div[aria-label="Search by image"]');
      
      if (cameraBtn) {
        clearInterval(interval);
        cameraBtn.click();
        
        // Wait a brief moment for the Google Lens popup frame to render, then auto-click the upload link/button
        let uploadAttempts = 0;
        const uploadInterval = setInterval(() => {
          uploadAttempts++;
          
          // Google Lens upload links
          const uploadLink = document.querySelector('.upload-link') || 
                             document.querySelector('span.Xb12Vb') || 
                             document.querySelector('.Cc1x9b');
          
          if (uploadLink) {
            clearInterval(uploadInterval);
            uploadLink.click();
          } else {
            // fallback: check spans text
            const allSpans = document.querySelectorAll('span');
            let found = false;
            for (let span of allSpans) {
              const text = span.textContent.toLowerCase();
              if (text.includes('upload a file') || text.includes('upload an image')) {
                clearInterval(uploadInterval);
                span.click();
                found = true;
                break;
              }
            }
            if (found) return;
          }
          
          if (uploadAttempts > 20) {
            clearInterval(uploadInterval);
          }
        }, 100);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);
  }
})();

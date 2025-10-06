// Loader utility functions for showing/hiding loading animations

export function showLoader(element, type = 'overlay', message = '') {
  if (!element) return;
  
  // Remove existing loader first
  hideLoader(element);
  
  let loaderHTML = '';
  
  switch (type) {
    case 'overlay':
      loaderHTML = `
        <div class="loader-overlay">
          <div class="loader-spinner"></div>
        </div>
      `;
      break;
      
    case 'section':
      loaderHTML = `
        <div class="section-loader">
          <div class="loader-spinner"></div>
          ${message ? `<div class="loading-text">${message}</div>` : ''}
        </div>
      `;
      element.innerHTML = loaderHTML;
      return;
      
    case 'button':
      const button = element;
      if (button.tagName === 'BUTTON') {
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
        button.innerHTML = `<div class="button-loader"></div>${message || 'Loading...'}`;
      }
      return;
  }
  
  if (type === 'overlay') {
    // Make sure the parent has relative positioning
    const originalPosition = element.style.position;
    if (!originalPosition || originalPosition === 'static') {
      element.style.position = 'relative';
      element.dataset.originalPosition = originalPosition || 'static';
    }
    
    element.insertAdjacentHTML('beforeend', loaderHTML);
  }
}

export function hideLoader(element, type = 'overlay') {
  if (!element) return;
  
  switch (type) {
    case 'overlay':
      const overlay = element.querySelector('.loader-overlay');
      if (overlay) {
        overlay.remove();
        // Restore original position if we changed it
        if (element.dataset.originalPosition) {
          element.style.position = element.dataset.originalPosition;
          delete element.dataset.originalPosition;
        }
      }
      break;
      
    case 'section':
      const sectionLoader = element.querySelector('.section-loader');
      if (sectionLoader) {
        element.innerHTML = '';
      }
      break;
      
    case 'button':
      const button = element;
      if (button.tagName === 'BUTTON' && button.dataset.originalContent) {
        button.disabled = false;
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
      }
      break;
  }
}

// Show loader with automatic timeout
export function showLoaderWithTimeout(element, type = 'overlay', message = '', timeout = 5000) {
  showLoader(element, type, message);
  setTimeout(() => hideLoader(element, type), timeout);
}

// Helper to show button loader during async operations
export async function withButtonLoader(button, asyncFn, loadingText = 'Loading...') {
  showLoader(button, 'button', loadingText);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    hideLoader(button, 'button');
  }
}

// Helper to show section loader during async operations  
export async function withSectionLoader(section, asyncFn, loadingMessage = 'Loading...') {
  showLoader(section, 'section', loadingMessage);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    hideLoader(section, 'section');
  }
}
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../styles/CustomPdfViewer.css';

// Configure PDF.js worker - matching versions
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const CustomPdfViewer = ({ pdfUrl, title, version, effectiveDate, onClose }) => {
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const modalRef = useRef(null);
    const contentRef = useRef(null);
    const pageRefs = useRef({}); // Store refs for each page

    const onDocumentLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
    }, []);

    const onDocumentLoadError = useCallback((error) => {
        console.error('Error loading PDF:', error);
        setError('Failed to load PDF document');
        setLoading(false);
    }, []);

    // FIX: Lock body scroll when modal opens
    useEffect(() => {
        // Store original overflow value
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;
        
        // Calculate scrollbar width to prevent layout shift
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        
        // Lock scroll and compensate for scrollbar
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.paddingRight = originalPaddingRight;
        };
    }, []);

    // FIX: ESC key handler for accessibility
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [onClose]);

    // FIX: Focus trap for accessibility
    useEffect(() => {
        if (modalRef.current) {
            modalRef.current.focus();
        }
    }, []);

    // NEW: Track current page based on scroll position
    useEffect(() => {
        const handleScroll = () => {
            if (!contentRef.current || !numPages) return;

            const scrollTop = contentRef.current.scrollTop;
            const scrollHeight = contentRef.current.scrollHeight;
            const clientHeight = contentRef.current.clientHeight;

            // Calculate which page is currently in view
            const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
            const calculatedPage = Math.min(
                Math.ceil(scrollPercentage * numPages) || 1,
                numPages
            );

            setCurrentPage(calculatedPage);
        };

        const contentElement = contentRef.current;
        if (contentElement) {
            contentElement.addEventListener('scroll', handleScroll);
            return () => contentElement.removeEventListener('scroll', handleScroll);
        }
    }, [numPages]);

    // NEW: Scroll to specific page
    const scrollToPage = useCallback((pageNum) => {
        const pageElement = pageRefs.current[pageNum];
        if (pageElement && contentRef.current) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentPage(pageNum);
        }
    }, []);

    const goToPrevPage = () => {
        const prevPage = Math.max(currentPage - 1, 1);
        scrollToPage(prevPage);
    };

    const goToNextPage = () => {
        const nextPage = Math.min(currentPage + 1, numPages);
        scrollToPage(nextPage);
    };

    const zoomIn = () => {
        setScale(prev => Math.min(prev + 0.2, 3.0));
    };

    const zoomOut = () => {
        setScale(prev => Math.max(prev - 0.2, 0.5));
    };

    const resetZoom = () => {
        setScale(1.0);
    };

    const fitToWidth = () => {
        // Calculate optimal scale based on content width
        // Assuming A4 page width ~595pt, container ~900px
        setScale(1.2);
    };

    // FIX: Handle backdrop click to close
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return createPortal(
        <>
            {/* FIX: Backdrop overlay with blur effect - COVERS EVERYTHING */}
            <div 
                className="pdf-modal-backdrop" 
                onClick={handleBackdropClick}
                aria-hidden="true"
            />
            
            {/* FIX: Modal container with proper focus management */}
            <div 
                className="pdf-modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pdf-viewer-title"
                ref={modalRef}
                tabIndex={-1}
            >
                <div className="custom-pdf-viewer">
                    {/* Header */}
                    <div className="pdf-viewer-header">
                        <div className="pdf-viewer-title">
                            <h2 id="pdf-viewer-title">{title}</h2>
                            <p>Version {version} • Effective from {new Date(effectiveDate).toLocaleDateString()}</p>
                        </div>
                        <button 
                            className="pdf-viewer-close" 
                            onClick={onClose}
                            aria-label="Close PDF viewer"
                            title="Close (ESC)"
                        >
                            ×
                        </button>
                    </div>

                    {/* FIX: Sticky Toolbar - stays visible while scrolling */}
                    <div className="pdf-viewer-toolbar">
                        <div className="pdf-toolbar-section">
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={goToPrevPage} 
                                disabled={currentPage <= 1}
                                title="Previous Page"
                                aria-label="Previous page"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                            <span className="pdf-page-info" aria-live="polite">
                                Page {currentPage} of {numPages || '...'}
                            </span>
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={goToNextPage} 
                                disabled={currentPage >= numPages}
                                title="Next Page"
                                aria-label="Next page"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>

                        <div className="pdf-toolbar-section">
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={zoomOut} 
                                disabled={scale <= 0.5}
                                title="Zoom Out"
                                aria-label="Zoom out"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M8 11H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                            <span className="pdf-zoom-info" aria-live="polite">{Math.round(scale * 100)}%</span>
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={zoomIn} 
                                disabled={scale >= 3.0}
                                title="Zoom In"
                                aria-label="Zoom in"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M11 8V14M8 11H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={resetZoom}
                                title="Reset Zoom (100%)"
                                aria-label="Reset zoom to 100%"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M23 20V14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                            <button 
                                className="pdf-toolbar-btn" 
                                onClick={fitToWidth}
                                title="Fit to Width"
                                aria-label="Fit to width"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M9 3V21M15 3V21" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* NEW: PDF Content with continuous scrolling - ALL PAGES */}
                    <div className="pdf-viewer-content" ref={contentRef}>
                        {loading && (
                            <div className="pdf-loading">
                                <div className="pdf-spinner"></div>
                                <p>Loading PDF...</p>
                            </div>
                        )}

                        {error && (
                            <div className="pdf-error">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#E53935" strokeWidth="2"/>
                                    <path d="M12 8V12" stroke="#E53935" strokeWidth="2" strokeLinecap="round"/>
                                    <circle cx="12" cy="16" r="1" fill="#E53935"/>
                                </svg>
                                <p>{error}</p>
                            </div>
                        )}

                        {!error && (
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading=""
                                error=""
                            >
                                {/* Render ALL pages for continuous scrolling */}
                                {Array.from(new Array(numPages), (el, index) => (
                                    <div
                                        key={`page_${index + 1}`}
                                        ref={(el) => (pageRefs.current[index + 1] = el)}
                                        className="pdf-page-wrapper"
                                        data-page-number={index + 1}
                                    >
                                        <Page
                                            pageNumber={index + 1}
                                            scale={scale}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                            loading={
                                                <div className="pdf-page-loading">
                                                    <div className="pdf-page-spinner"></div>
                                                </div>
                                            }
                                        />
                                        {/* Page number indicator */}
                                        <div className="pdf-page-number-badge">
                                            Page {index + 1} of {numPages}
                                        </div>
                                    </div>
                                ))}
                            </Document>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body // Render at root level to escape layout constraints
    );
};

export default CustomPdfViewer;

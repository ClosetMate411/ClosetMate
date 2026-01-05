import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { Group, Text, Button } from '@mantine/core';
import { IconUpload, IconPhoto, IconX, IconTrash } from '@tabler/icons-react';
import { Dropzone } from '@mantine/dropzone';
import { validateImageFile } from '../../utils';
import './ClothingDropzone.css';

const ClothingDropzone = ({ onFilesAccepted, onFilesRejected, onApply, onCancel }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const openRef = useRef(null);
  const filesRef = useRef([]);
  const appliedRef = useRef(false); // Track if files were applied (passed to parent)

  // Keep ref in sync with state for cleanup
  useEffect(() => {
    filesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  const handleReject = useCallback((files) => {
    if (onFilesRejected) {
      onFilesRejected(files);
    }
  }, [onFilesRejected]);

  const handleDrop = useCallback((files) => {
    const validFiles = [];
    const rejectedFiles = [];

    files.forEach(file => {
      const validation = validateImageFile(file);

      if (!validation.isValid) {
        rejectedFiles.push({ file, errors: [{ code: validation.code, message: validation.error }] });
      } else {
        validFiles.push(file);
      }
    });

    if (rejectedFiles.length > 0) {
      handleReject(rejectedFiles);
      if (validFiles.length === 0) return; // Don't proceed if no valid files
    }

    // Clean up previous local previews
    filesRef.current.forEach(file => {
      URL.revokeObjectURL(file.preview);
    });
    
    const newFiles = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    }));
    
    setUploadedFiles(newFiles);
    appliedRef.current = false;
    
    if (onFilesAccepted) {
      onFilesAccepted(validFiles);
    }
  }, [onFilesAccepted, handleReject]);

  const handleDelete = useCallback((e, id) => {
    e.stopPropagation();
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleApply = useCallback(() => {
    if (onApply && uploadedFiles.length > 0) {
      appliedRef.current = true; // Mark as applied - don't cleanup these URLs
      onApply(uploadedFiles);
    }
  }, [onApply, uploadedFiles]);

  const handleCancelClick = useCallback(() => {
    // Clean up URLs only if not applied
    if (!appliedRef.current) {
      filesRef.current.forEach(file => {
        URL.revokeObjectURL(file.preview);
      });
    }
    setUploadedFiles([]);
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleDownload = useCallback((e, file) => {
    e.stopPropagation();
    
    const link = document.createElement('a');
    link.href = file.preview;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Cleanup URLs when component unmounts - but only if not applied
  useEffect(() => {
    return () => {
      // Don't revoke URLs if they were passed to the parent (applied)
      if (!appliedRef.current) {
        filesRef.current.forEach(file => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
      }
    };
  }, []);

  return (
    <div className="dropzone-wrapper">
      <Dropzone
        openRef={openRef}
        onDrop={handleDrop}
        onReject={handleReject}
        multiple={false}
        className="clothing-dropzone"
      >
        <Group justify="center" gap="md" mih={150} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload 
              size={40} 
              color="var(--mantine-color-blue-6)" 
              stroke={1.5} 
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX 
              size={40} 
              color="var(--mantine-color-red-6)" 
              stroke={1.5} 
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto 
              size={40} 
              color="var(--mantine-color-dimmed)" 
              stroke={1.5} 
            />
          </Dropzone.Idle>

          <div>
            <Text size="lg" inline>
              Drag images here or click to select files
            </Text>
            <Text size="sm" c="dimmed" inline mt={4}>
              Each file should not exceed 10MB (JPEG, PNG, HEIC)
            </Text>
          </div>
        </Group>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files-list" style={{ pointerEvents: 'auto' }}>
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-item">
                <IconPhoto size={20} className="file-icon" />
                <span 
                  className="file-name" 
                  title={file.name}
                  onClick={(e) => handleDownload(e, file)}
                  role="button"
                  tabIndex={0}
                >
                  {file.name}
                </span>
                <button
                  className="delete-icon-btn"
                  onClick={(e) => handleDelete(e, file.id)}
                  aria-label="Delete file"
                >
                  <IconX size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Dropzone>

      <Button
        onClick={() => openRef.current?.()}
        leftSection={<IconUpload size={18} />}
        variant="filled"
        size="md"
        fullWidth
        className="choose-file-button"
      >
        Choose File
      </Button>

      <div className="action-buttons">
        <button 
          className="cancel-button" 
          onClick={handleCancelClick}
          type="button"
        >
          Cancel
        </button>
        <button 
          className="apply-button" 
          onClick={handleApply}
          type="button"
          disabled={uploadedFiles.length === 0}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

ClothingDropzone.propTypes = {
  onFilesAccepted: PropTypes.func,
  onFilesRejected: PropTypes.func,
  onApply: PropTypes.func,
  onCancel: PropTypes.func,
  maxSize: PropTypes.number
};

export default memo(ClothingDropzone);


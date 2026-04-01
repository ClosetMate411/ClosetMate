import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { LoadingScreen } from '../../../components';

const LoadingOverlay = ({ uploadState, loading }) => {
  const isLoading = loading || ['processing', 'saving', 'analyzing', 'updating', 'deleting'].includes(uploadState);

  if (!isLoading) return null;

  const getLoadingMessage = () => {
    if (uploadState === 'processing') return "Removing background...";
    if (uploadState === 'saving') return "Saving item...";
    if (uploadState === 'analyzing') return "Analyzing with AI...";
    if (uploadState === 'updating') return "Updating changes...";
    if (uploadState === 'deleting') return "Deleting item...";
    return "Fetching your wardrobe...";
  };

  return <LoadingScreen message={getLoadingMessage()} />;
};

LoadingOverlay.propTypes = {
  uploadState: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired
};

export default memo(LoadingOverlay);

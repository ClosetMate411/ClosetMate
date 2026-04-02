import React, { memo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '@mantine/core';
import './ShareOutfitModal.css';

const ShareOutfitModal = ({ opened, onClose, outfits, wardrobeItems, onShare }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setDescription('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleShare = useCallback(async () => {
    if (!selectedId || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onShare(selectedId, description.trim() || null);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to share outfit. Please try again.');
      setLoading(false);
    }
  }, [selectedId, description, loading, onShare, handleClose]);

  // Outfits already shared have is_shareable === true — hide them from the picker
  const sharableOutfits = outfits.filter((o) => !o.is_shareable);

  const getThumbImages = (outfit) =>
    outfit.item_ids
      .slice(0, 4)
      .map((id) => wardrobeItems.find((w) => w.id === id) || null);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Share an Outfit"
      centered
      size="lg"
    >
      <div className="share-modal">
        {sharableOutfits.length === 0 ? (
          <div className="share-modal-empty">
            <div className="share-empty-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <p>
              {outfits.length === 0
                ? 'You have no saved outfits yet. Generate and save some first!'
                : 'All your outfits are already shared with the community.'}
            </p>
          </div>
        ) : (
          <>
            <p className="share-section-label">Select an outfit</p>

            <div className="share-outfits-grid">
              {sharableOutfits.map((outfit) => {
                const thumbImages = getThumbImages(outfit);
                const isSelected = selectedId === outfit.id;
                return (
                  <button
                    key={outfit.id}
                    className={`share-outfit-option${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedId(outfit.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="share-outfit-collage">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="share-collage-cell">
                          {thumbImages[i] ? (
                            <img src={thumbImages[i].image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="share-collage-placeholder" />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="share-outfit-name">{outfit.name}</p>
                    <div className="share-outfit-tags">
                      {outfit.style && <span className="meta-tag">{outfit.style}</span>}
                      {outfit.season && <span className="meta-tag">{outfit.season}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="share-description-section">
              <label className="share-section-label" htmlFor="share-description">
                Description <span className="share-label-optional">(optional)</span>
              </label>
              <textarea
                id="share-description"
                className="share-textarea"
                placeholder="Share what makes this outfit special…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <span className="share-char-count">{description.length}/500</span>
            </div>

            {error && <p className="share-error">{error}</p>}

            <div className="share-modal-footer">
              <button className="share-cancel-btn" onClick={handleClose} type="button">
                Cancel
              </button>
              <button
                className="share-submit-btn"
                onClick={handleShare}
                disabled={!selectedId || loading}
                type="button"
              >
                {loading ? 'Sharing…' : 'Share to Community'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

ShareOutfitModal.propTypes = {
  opened: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  outfits: PropTypes.array.isRequired,
  wardrobeItems: PropTypes.array.isRequired,
  onShare: PropTypes.func.isRequired,
};

export default memo(ShareOutfitModal);

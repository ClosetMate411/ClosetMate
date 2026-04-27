import React, { memo } from "react";
import PropTypes from "prop-types";
import { ConfirmModal } from "../";
import { useModal } from "../../hooks";
import "./ClothingDetail.css";

const ClothingDetail = ({ item, onBack, onDelete, onReanalyze, reanalyzing }) => {
  const modal = useModal();

  const handleDelete = () => {
    onDelete();
  };

  // Show the Reanalyze affordance when the AI never assigned a name —
  // these are the cases where the synchronous Gemini call failed and
  // the user is stuck with the placeholder.
  const isUntitled = !item.name || item.name === "Untitled";
  const canReanalyze = isUntitled && typeof onReanalyze === "function";

  return (
    <div className="cd-root">
      <div className="cd-image-col">
        <img src={item.image} alt={item.name} className="cd-image" />
      </div>

      <div className="cd-info-col">
        <div className="cd-info-body">
          <div className="cd-field">
            <span className="cd-label">Item Name</span>
            <h2 className="cd-name">{item.name}</h2>
            {canReanalyze && (
              <button
                type="button"
                className="cd-btn cd-btn--reanalyze"
                onClick={onReanalyze}
                disabled={reanalyzing}
              >
                {reanalyzing ? "Re-analysing…" : "Re-run AI analysis"}
              </button>
            )}
          </div>

          {item.weather && (
            <>
              <hr className="cd-divider" />
              <div className="cd-field cd-field--inline">
                <span className="cd-label">Weather</span>
                <p className="cd-weather">{item.weather}</p>
              </div>
            </>
          )}
        </div>

        <div className="cd-actions">
          <button className="cd-btn cd-btn--back" onClick={onBack}>
            Back
          </button>
          <button className="cd-btn cd-btn--delete" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />
    </div>
  );
};

ClothingDetail.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    weather: PropTypes.string,
    image: PropTypes.string.isRequired,
  }).isRequired,
  onBack: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onReanalyze: PropTypes.func,
  reanalyzing: PropTypes.bool,
};

export default memo(ClothingDetail);

import React, { memo, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { Modal } from "@mantine/core";
import { IconTrash, IconDeviceFloppy, IconAlertCircle } from '@tabler/icons-react';
import "./ConfirmModal.css";

const ConfirmModal = ({ 
  opened, 
  onClose, 
  onConfirm, 
  title, 
  message,
  subtitle,
  variant = "delete" // "delete" | "save" | "unsaved"
}) => {
  const config = useMemo(() => {
    switch (variant) {
      case "delete":
        return {
          icon: <IconTrash size={40} stroke={2} />,
          iconClass: "confirm-icon-delete",
          confirmLabel: "Delete",
          confirmClass: "confirm-btn-delete",
          showCancel: true
        };
      case "save":
        return {
          icon: <IconDeviceFloppy size={40} stroke={2} />,
          iconClass: "confirm-icon-save",
          confirmLabel: "Save",
          confirmClass: "confirm-btn-save",
          showCancel: true
        };
      case "unsaved":
        return {
          icon: <IconAlertCircle size={40} stroke={2} />,
          iconClass: "confirm-icon-unsaved",
          confirmLabel: "Leave",
          confirmClass: "confirm-btn-unsaved",
          showCancel: true,
          cancelLabel: "Cancel"
        };
      default:
        return {
          icon: <IconTrash size={40} stroke={2} />,
          iconClass: "confirm-icon-delete",
          confirmLabel: "Confirm",
          confirmClass: "confirm-btn-delete",
          showCancel: true
        };
    }
  }, [variant]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      withCloseButton={false}
      padding="lg"
    >
      <div className="confirm-modal-content">
        <div className={`confirm-modal-icon ${config.iconClass}`}>
          {config.icon}
        </div>
        
        <h2 className="confirm-modal-title">{title}</h2>
        
        <p className="confirm-modal-message">{message}</p>
        
        {subtitle && <p className="confirm-modal-subtitle">{subtitle}</p>}
        
        <div className="confirm-modal-actions">
          {config.showCancel && (
            <button 
              className="confirm-btn confirm-btn-cancel" 
              onClick={onClose}
              type="button"
            >
              {config.cancelLabel || "Cancel"}
            </button>
          )}
          <button 
            className={`confirm-btn ${config.confirmClass}`}
            onClick={handleConfirm}
            type="button"
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

ConfirmModal.propTypes = {
  opened: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  subtitle: PropTypes.string,
  variant: PropTypes.oneOf(['delete', 'save', 'unsaved'])
};

export default memo(ConfirmModal);


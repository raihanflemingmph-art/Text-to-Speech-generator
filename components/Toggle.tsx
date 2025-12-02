import React from 'react';

interface ToggleProps {
  label: string;
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ label, isActive, onToggle, disabled }) => {
  return (
    <div className={`flex items-center justify-between px-4 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="font-medium text-gray-700">{label}</span>
      <button
        onClick={!disabled ? onToggle : undefined}
        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out flex items-center ${
          isActive ? 'bg-blue-600' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
            isActive ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export default Toggle;
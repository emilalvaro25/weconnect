/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import cn from 'classnames';
import { AudioEffects } from '@/lib/audio-effects';

interface AudioEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  effects: AudioEffects;
}

const AudioEffectsPanel: React.FC<AudioEffectsPanelProps> = ({
  isOpen,
  onClose,
  effects,
}) => {
  // Local state to manage UI controls
  const [isReverbOn, setIsReverbOn] = useState(false);
  const [reverbMix, setReverbMix] = useState(0.5);

  const [isDelayOn, setIsDelayOn] = useState(false);
  const [delayTime, setDelayTime] = useState(0.5);
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [delayMix, setDelayMix] = useState(0.5);


  const handleReverbToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsReverbOn(checked);
    effects.toggleReverb(checked);
    if(checked) {
        effects.setReverbMix(reverbMix);
    }
  };
  const handleReverbMixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setReverbMix(value);
    effects.setReverbMix(value);
  };


  const handleDelayToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsDelayOn(checked);
    effects.toggleDelay(checked);
    if(checked) {
        effects.setDelayMix(delayMix);
    }
  };

  const handleDelayTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDelayTime(value);
    effects.setDelayTime(value);
  };

  const handleDelayFeedbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDelayFeedback(value);
    effects.setDelayFeedback(value);
  };
    
  const handleDelayMixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDelayMix(value);
    effects.setDelayMix(value);
  };

  return (
    <aside className={cn('audio-effects-panel', { open: isOpen })}>
      <div className="effects-panel-header">
        <h3>Audio Effects</h3>
        <button onClick={onClose} className="icon-button">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="effects-panel-body">
        {/* Reverb Controls */}
        <div className="effect-control">
          <div className="effect-control-header">
            <label htmlFor="reverb-toggle">Reverb</label>
            <label className="toggle-switch">
              <input id="reverb-toggle" type="checkbox" checked={isReverbOn} onChange={handleReverbToggle} />
              <span className="toggle-switch-slider"></span>
            </label>
          </div>
          {isReverbOn && (
            <div className="slider-control">
              <label htmlFor="reverb-mix">Wet/Dry Mix</label>
              <input id="reverb-mix" type="range" min="0" max="1" step="0.01" value={reverbMix} onChange={handleReverbMixChange} />
            </div>
          )}
        </div>
        {/* Delay (Echo) Controls */}
        <div className="effect-control">
          <div className="effect-control-header">
            <label htmlFor="delay-toggle">Echo (Delay)</label>
            <label className="toggle-switch">
              <input id="delay-toggle" type="checkbox" checked={isDelayOn} onChange={handleDelayToggle} />
              <span className="toggle-switch-slider"></span>
            </label>
          </div>
          {isDelayOn && (
            <>
              <div className="slider-control">
                <label htmlFor="delay-time">Time</label>
                <input id="delay-time" type="range" min="0" max="2" step="0.01" value={delayTime} onChange={handleDelayTimeChange} />
              </div>
               <div className="slider-control">
                <label htmlFor="delay-feedback">Feedback</label>
                <input id="delay-feedback" type="range" min="0" max="0.9" step="0.01" value={delayFeedback} onChange={handleDelayFeedbackChange} />
              </div>
              <div className="slider-control">
                <label htmlFor="delay-mix">Wet/Dry Mix</label>
                <input id="delay-mix" type="range" min="0" max="1" step="0.01" value={delayMix} onChange={handleDelayMixChange} />
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AudioEffectsPanel;

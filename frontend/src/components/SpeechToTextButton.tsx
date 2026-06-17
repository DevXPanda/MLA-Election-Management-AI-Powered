'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'react-hot-toast';

interface SpeechToTextButtonProps {
  onTranscript: (text: string) => void;
  currentValue: string;
  className?: string;
}

export default function SpeechToTextButton({
  onTranscript,
  currentValue,
  className = '',
}: SpeechToTextButtonProps) {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const initialValueRef = useRef<string>('');

  useEffect(() => {
    // Check support on mount
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = () => {
    if (!isSupported) {
      toast.error(t('stt.not_supported', 'Speech-to-Text is not supported in this browser. Please use Chrome or Safari.'));
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';

      // Keep track of what was in the input before we started speaking
      initialValueRef.current = currentValue;

      recognition.onstart = () => {
        setIsListening(true);
        toast.success(
          language === 'hi'
            ? 'बोलना शुरू करें... (हिंदी)'
            : 'Listening... Speak naturally in English'
        );
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'aborted') {
          // Ignore aborted event as it is triggered normally when calling stop()
          return;
        }
        if (event.error === 'not-allowed') {
          toast.error(t('stt.permission_denied', 'Microphone permission denied. Please allow microphone access.'));
        } else if (event.error === 'no-speech') {
          toast.error(t('stt.no_speech', 'No speech was detected. Please try again.'));
        } else if (event.error === 'network') {
          toast.error(t('stt.network_error', 'Network error. Speech recognition requires an active internet connection.'));
        } else {
          toast.error(`${t('stt.error', 'An error occurred during speech recognition.')} (${event.error})`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      let accumulatedFinal = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        accumulatedFinal += finalTranscript;

        // Combine the initial value, the accumulated final text, and the interim text
        const baseText = initialValueRef.current 
          ? initialValueRef.current + (initialValueRef.current.endsWith(' ') ? '' : ' ')
          : '';

        const currentSpeech = accumulatedFinal + interimTranscript;
        
        onTranscript(baseText + currentSpeech);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start SpeechRecognition:', err);
      toast.error(t('stt.failed_start', 'Failed to start microphone.'));
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission or button default action
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center shrink-0 ${
        isListening
          ? 'bg-red-500/15 border-red-500 text-red-500 hover:bg-red-500/25 animate-pulse shadow-md shadow-red-500/10'
          : 'bg-dark-50/50 dark:bg-dark-800/40 border-dark-200 dark:border-white/[0.06] text-dark-500 hover:text-saffron-500 dark:hover:text-saffron-400 hover:border-saffron-500/20'
      } ${className}`}
      title={isListening ? t('stt.stop', 'Stop Listening') : t('stt.start', 'Start Speech-to-Text')}
    >
      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}

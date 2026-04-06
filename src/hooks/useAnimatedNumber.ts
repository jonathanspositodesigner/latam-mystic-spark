import { useState, useEffect, useRef, useCallback } from 'react';

interface AnimatedNumberResult {
  displayValue: number;
  isAnimating: boolean;
  direction: 'up' | 'down' | null;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const useAnimatedNumber = (
  targetValue: number,
  duration: number = 500
): AnimatedNumberResult => {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  
  const animationRef = useRef<number | null>(null);
  const currentValueRef = useRef(targetValue);
  const previousTargetRef = useRef(targetValue);
  const directionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previousTargetRef.current === targetValue) return;

    const startValue = currentValueRef.current;
    const difference = targetValue - startValue;
    if (difference === 0) { previousTargetRef.current = targetValue; return; }

    const newDirection = difference > 0 ? 'up' : 'down';
    setDirection(newDirection);
    setIsAnimating(true);
    
    if (directionTimeoutRef.current) clearTimeout(directionTimeoutRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.round(startValue + difference * easeOutCubic(progress));
      
      currentValueRef.current = currentValue;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        currentValueRef.current = targetValue;
        setDisplayValue(targetValue);
        setIsAnimating(false);
        directionTimeoutRef.current = setTimeout(() => setDirection(null), 1500);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    previousTargetRef.current = targetValue;

    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [targetValue, duration]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (directionTimeoutRef.current) clearTimeout(directionTimeoutRef.current);
    };
  }, []);

  return { displayValue, isAnimating, direction };
};

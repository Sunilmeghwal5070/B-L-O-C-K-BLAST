import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';

export const AnimatedScore: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const controls = useAnimation();

  useEffect(() => {
    if (value === displayValue) return;

    controls.start({
      scale: [1, 1.2, 1],
      transition: { duration: 0.3 }
    });

    let startTime = performance.now();
    const duration = 250; // ms to complete animation fast
    const initialValue = displayValue;

    let currReq: number;

    const animateNumber = (time: number) => {
      const elapsed = time - startTime;
      if (elapsed >= duration) {
        setDisplayValue(value);
      } else {
        // Ease out quadratic
        const progress = elapsed / duration;
        const easeOut = 1 - (1 - progress) * (1 - progress);
        setDisplayValue(Math.floor(initialValue + (value - initialValue) * easeOut));
        currReq = requestAnimationFrame(animateNumber);
      }
    };

    currReq = requestAnimationFrame(animateNumber);

    return () => cancelAnimationFrame(currReq);
  }, [value, displayValue, controls]);

  return (
    <motion.div
      animate={controls}
      className="text-6xl font-black text-white drop-shadow-lg"
    >
      {displayValue}
    </motion.div>
  );
};

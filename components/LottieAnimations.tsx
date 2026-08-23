import React from 'react';
import { useLottie } from 'lottie-react';
import loadingAnimation from '../public/lotties/loading.json';

export const LottieLoader = ({ size = 48, className = "" }) => {
  const options: any = {
    animationData: loadingAnimation,
    loop: true,
  };
  const lottieObj: any = useLottie(options);

  return (
    <div className={`flex justify-center items-center ${className}`} style={{ width: size, height: size }}>
      {lottieObj.View}
    </div>
  );
};

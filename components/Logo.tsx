/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg 
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#a5b4fc'}} />
                <stop offset="100%" style={{stopColor: '#6366f1'}} />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="2" dy="2" result="offsetblur" />
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Speech Bubble */}
        <path 
            d="M50,5 C25.1,5 5,25.1 5,50 C5,74.9 25.1,95 50,95 L50,95 L65,95 L80,80 L80,50 C80,25.1 60,5 50,5 Z"
            fill="url(#logoGradient)"
            filter="url(#shadow)"
        />

        {/* Quill */}
        <g transform="translate(45, 45) rotate(45)">
            <path
                d="M-15,-25 C-15,-35 -5,-35 0,-30 L0,15 C-5,20 -15,20 -15,10 Z"
                fill="#FFFFFF"
                stroke="#E5E7EB"
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <line x1="0" y1="-30" x2="0" y2="25" stroke="#E5E7EB" strokeWidth="2.5" />
            <path
                d="M0,-28 L5,-25 M0,-23 L7,-20 M0,-18 L9,-15 M0,-13 L9,-10 M0,-8 L7,-5 M0,-3 L5,0"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </g>
    </svg>
);

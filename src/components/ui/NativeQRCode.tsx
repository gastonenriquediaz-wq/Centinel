import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCodeGenerator from 'qrcode';

interface NativeQRCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

/**
 * Renderizador de Código QR basado exclusivamente en primitivas nativas de React Native (View).
 * No depende de librerías nativas conflictivas de SVG ni módulos binarios, garantizando
 * máxima compatibilidad y estabilidad en Android y Expo Go.
 */
export const NativeQRCode: React.FC<NativeQRCodeProps> = ({
  value,
  size = 240,
  color = '#0F172A',
  backgroundColor = '#FFFFFF',
}) => {
  const qrMatrix = useMemo(() => {
    try {
      const qr = QRCodeGenerator.create(value, {
        errorCorrectionLevel: 'M',
      });
      const modules = qr.modules;
      const moduleCount = modules.size;
      const matrix: boolean[][] = [];

      for (let row = 0; row < moduleCount; row++) {
        const rowData: boolean[] = [];
        for (let col = 0; col < moduleCount; col++) {
          rowData.push(Boolean(modules.get(row, col)));
        }
        matrix.push(rowData);
      }
      return matrix;
    } catch {
      return null;
    }
  }, [value]);

  if (!qrMatrix) {
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }

  const moduleCount = qrMatrix.length;
  const cellSize = size / moduleCount;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
      }}
    >
      {qrMatrix.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: 'row',
            height: cellSize,
          }}
        >
          {row.map((isDark, colIndex) => (
            <View
              key={colIndex}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: isDark ? color : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

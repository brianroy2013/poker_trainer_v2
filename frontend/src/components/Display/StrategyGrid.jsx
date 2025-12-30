import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Action colors
const ACTION_COLORS = {
  'c': '#3b82f6',      // Check/Call - Blue
  'f': '#6b7280',      // Fold - Gray
};

// Generate colors for bet sizes (reds/oranges)
const getBetColor = (action) => {
  if (!action.startsWith('b')) return '#ef4444';
  const size = parseInt(action.substring(1)) || 0;
  // Smaller bets = lighter red, bigger bets = darker red
  if (size < 50) return '#f97316';      // Orange
  if (size < 100) return '#ef4444';     // Red
  if (size < 200) return '#dc2626';     // Dark red
  return '#991b1b';                      // Very dark red
};

const getActionColor = (action) => {
  if (action in ACTION_COLORS) return ACTION_COLORS[action];
  if (action.startsWith('b')) return getBetColor(action);
  return '#a855f7';  // Purple for unknown
};

const getActionLabel = (action) => {
  if (action === 'c') return 'X/C';
  if (action === 'f') return 'Fold';
  if (action.startsWith('b')) return `B${action.substring(1)}`;
  return action;
};

function StrategyGrid({ strategyData }) {
  if (!strategyData || !strategyData.grid) {
    return (
      <div className="strategy-grid-placeholder">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Strategy available from flop
        </p>
      </div>
    );
  }

  const { grid, actions } = strategyData;

  const getCellLabel = (row, col) => {
    if (row === col) {
      return RANKS[row] + RANKS[col];  // Pairs: AA, KK
    } else if (row < col) {
      return RANKS[row] + RANKS[col] + 's';  // Suited: AKs
    } else {
      return RANKS[col] + RANKS[row] + 'o';  // Offsuit: AKo
    }
  };

  const getCellStyle = (cellActions) => {
    if (!cellActions || Object.keys(cellActions).length === 0) {
      return { backgroundColor: 'rgba(255, 255, 255, 0.05)' };
    }

    // Create gradient based on action frequencies
    const sortedActions = Object.entries(cellActions)
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => b[1] - a[1]);

    if (sortedActions.length === 0) {
      return { backgroundColor: 'rgba(255, 255, 255, 0.05)' };
    }

    if (sortedActions.length === 1) {
      const [action, freq] = sortedActions[0];
      const color = getActionColor(action);
      return { backgroundColor: color, opacity: 0.4 + freq * 0.6 };
    }

    // Multiple actions - create gradient
    let gradientParts = [];
    let cumulative = 0;
    for (const [action, freq] of sortedActions) {
      const color = getActionColor(action);
      const start = cumulative * 100;
      cumulative += freq;
      const end = cumulative * 100;
      gradientParts.push(`${color} ${start.toFixed(0)}% ${end.toFixed(0)}%`);
    }

    return {
      background: `linear-gradient(135deg, ${gradientParts.join(', ')})`,
    };
  };

  const getCellTooltip = (row, col, cellActions) => {
    const handLabel = getCellLabel(row, col);
    if (!cellActions || Object.keys(cellActions).length === 0) {
      return `${handLabel}: Not in range`;
    }

    const parts = Object.entries(cellActions)
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([action, freq]) => `${getActionLabel(action)}: ${(freq * 100).toFixed(0)}%`);

    return `${handLabel}\n${parts.join('\n')}`;
  };

  return (
    <div className="strategy-grid">
      <div className="grid-container">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="grid-row">
            {row.map((cellActions, colIdx) => (
              <div
                key={colIdx}
                className="grid-cell"
                style={getCellStyle(cellActions)}
                title={getCellTooltip(rowIdx, colIdx, cellActions)}
              >
                <span className="cell-label">{getCellLabel(rowIdx, colIdx)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      {actions && actions.length > 0 && (
        <div className="strategy-legend">
          {actions.map((action) => (
            <div key={action} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: getActionColor(action) }}
              />
              <span>{getActionLabel(action)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StrategyGrid;

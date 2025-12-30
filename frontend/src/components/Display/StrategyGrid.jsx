import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// PioSolver-style colors
// Fold = Blue, Check/Call = Green, Bets = Orange/Red shades
const ACTION_COLORS = {
  'c': 'rgb(143, 188, 139)',   // Check/Call - Green
  'f': 'rgb(109, 162, 192)',   // Fold - Blue
};

// Bet colors: smallest = light, largest = dark
const BET_COLOR_SMALL = { r: 233, g: 150, b: 122 };  // Light orange/salmon
const BET_COLOR_LARGE = { r: 177, g: 91, b: 74 };    // Dark red/brown

// Interpolate between two colors based on ratio (0 = small, 1 = large)
const interpolateColor = (ratio) => {
  const r = Math.round(BET_COLOR_SMALL.r + (BET_COLOR_LARGE.r - BET_COLOR_SMALL.r) * ratio);
  const g = Math.round(BET_COLOR_SMALL.g + (BET_COLOR_LARGE.g - BET_COLOR_SMALL.g) * ratio);
  const b = Math.round(BET_COLOR_SMALL.b + (BET_COLOR_LARGE.b - BET_COLOR_SMALL.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
};

// Build bet color map based on available bet sizes
// actions can be objects {action, amount, total} or strings
const buildBetColorMap = (actions) => {
  const betActions = actions.filter(a => {
    const actionStr = typeof a === 'object' ? a.action : a;
    return actionStr?.startsWith('b');
  });
  if (betActions.length === 0) return {};

  // Extract and sort bet sizes (use amount for actual size when available)
  const betSizes = betActions
    .map(a => {
      const actionStr = typeof a === 'object' ? a.action : a;
      const size = typeof a === 'object' && a.amount != null ? a.amount : (parseInt(actionStr.substring(1)) || 0);
      return { action: actionStr, size };
    })
    .sort((a, b) => a.size - b.size);

  const colorMap = {};

  if (betSizes.length === 1) {
    // Single bet: use small color
    colorMap[betSizes[0].action] = interpolateColor(0);
  } else {
    // Multiple bets: interpolate based on position
    betSizes.forEach((bet, index) => {
      const ratio = index / (betSizes.length - 1);
      colorMap[bet.action] = interpolateColor(ratio);
    });
  }

  return colorMap;
};

const getActionColor = (action, betColorMap = {}) => {
  if (action in ACTION_COLORS) return ACTION_COLORS[action];
  if (action in betColorMap) return betColorMap[action];
  if (action.startsWith('b')) return interpolateColor(0.5);  // Fallback
  return '#a855f7';  // Purple for unknown
};

const getActionLabel = (action, isCheck = true, pot = 0, currentBet = 0, actualAmount = null) => {
  if (action === 'c') return isCheck ? 'X' : 'C';
  if (action === 'f') return 'F';
  if (action.startsWith('b')) {
    // Use actualAmount if provided, otherwise parse from action string (fallback for grid cells)
    const amount = actualAmount !== null ? actualAmount : (parseInt(action.substring(1)) || 0);
    if (currentBet > 0) {
      // It's a raise - show multiplier
      const multiplier = amount / currentBet;
      const multDisplay = multiplier % 1 === 0 ? multiplier.toFixed(0) : multiplier.toFixed(1);
      return `R${amount} (${multDisplay}x)`;
    } else {
      // It's a bet - show pot percentage
      const pct = pot > 0 ? Math.round((amount / pot) * 100) : 0;
      return `B${amount} (${pct}%)`;
    }
  }
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

  const { grid, actions, is_check, pot, current_bet } = strategyData;
  const isCheck = is_check !== false; // Default to true if not specified
  const potValue = pot || 0;
  const currentBet = current_bet || 0;

  // Build bet color map based on available actions at this node
  const betColorMap = buildBetColorMap(actions || []);

  // Build mapping from action strings to actual amounts (for tooltips)
  const actionAmountMap = {};
  (actions || []).forEach(a => {
    if (typeof a === 'object' && a.action && a.amount != null) {
      actionAmountMap[a.action] = a.amount;
    }
  });

  // Calculate total frequency for each cell (sum of action frequencies = % in range)
  const getCellFrequency = (cellActions) => {
    if (!cellActions || Object.keys(cellActions).length === 0) return 0;
    return Math.min(Object.values(cellActions).reduce((sum, freq) => sum + freq, 0), 1);
  };

  const getCellLabel = (row, col) => {
    if (row === col) {
      return RANKS[row] + RANKS[col];  // Pairs: AA, KK
    } else if (row < col) {
      return RANKS[row] + RANKS[col] + 's';  // Suited: AKs
    } else {
      return RANKS[col] + RANKS[row] + 'o';  // Offsuit: AKo
    }
  };

  // Build 2D gradient:
  // - Vertical: gray on top (not in range), transparent on bottom (in range)
  // - Horizontal: action colors left-to-right
  const getCellStyle = (cellActions) => {
    const inRangePercent = getCellFrequency(cellActions) * 100;
    const notInRangePercent = 100 - inRangePercent;

    if (inRangePercent === 0) {
      // Not in range at all
      return { backgroundColor: 'rgb(27, 27, 40)' };
    }

    // Get action colors for the in-range portion
    // Order: bets (largest to smallest), call/check, fold
    const getActionOrder = (action) => {
      if (action.startsWith('b')) {
        // Negative size so larger bets sort first
        return -(parseInt(action.substring(1)) || 0);
      }
      if (action === 'c') return 1000;  // Call/check after bets
      if (action === 'f') return 2000;  // Fold last
      return 1500;  // Unknown actions
    };

    const sortedActions = Object.entries(cellActions || {})
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => getActionOrder(a[0]) - getActionOrder(b[0]));

    if (sortedActions.length === 0) {
      return { backgroundColor: 'rgb(27, 27, 40)' };
    }

    // Build horizontal gradient for action colors (left to right)
    let actionGradientParts = [];
    const totalActionFreq = sortedActions.reduce((sum, [_, f]) => sum + f, 0);
    let cumulative = 0;

    for (const [action, freq] of sortedActions) {
      const color = getActionColor(action, betColorMap);
      const actionPercent = (freq / totalActionFreq) * 100;
      const start = cumulative;
      cumulative += actionPercent;
      actionGradientParts.push(`${color} ${start.toFixed(1)}%`);
      actionGradientParts.push(`${color} ${cumulative.toFixed(1)}%`);
    }

    const actionGradient = `linear-gradient(to right, ${actionGradientParts.join(', ')})`;

    // Build vertical overlay: solid color on top (not in range), transparent on bottom
    if (notInRangePercent > 0) {
      const notInRangeOverlay = `linear-gradient(to bottom, rgb(27, 27, 40) 0%, rgb(27, 27, 40) ${notInRangePercent.toFixed(1)}%, transparent ${notInRangePercent.toFixed(1)}%)`;
      return {
        background: `${notInRangeOverlay}, ${actionGradient}`,
      };
    }

    return {
      background: actionGradient,
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
      .map(([action, freq]) => {
        const actualAmount = actionAmountMap[action] ?? null;
        return `${getActionLabel(action, isCheck, potValue, currentBet, actualAmount)}: ${(freq * 100).toFixed(0)}%`;
      });

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
          {actions.map((actionObj) => {
            const actionStr = typeof actionObj === 'object' ? actionObj.action : actionObj;
            const actualAmount = typeof actionObj === 'object' ? actionObj.amount : null;
            return (
              <div key={actionStr} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: getActionColor(actionStr, betColorMap) }}
                />
                <span>{getActionLabel(actionStr, isCheck, potValue, currentBet, actualAmount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StrategyGrid;

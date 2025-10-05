/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import { useUI } from '@/lib/state';
import cn from 'classnames';

const SNACKBAR_TIMEOUT = 4000;

const Snackbar = () => {
  const { snackbarMessage, showSnackbar } = useUI();

  useEffect(() => {
    if (snackbarMessage) {
      const timer = setTimeout(() => {
        showSnackbar(null);
      }, SNACKBAR_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [snackbarMessage, showSnackbar]);

  return (
    <div className={cn('snackbar', { show: !!snackbarMessage })}>
      {snackbarMessage}
    </div>
  );
};
export default Snackbar;
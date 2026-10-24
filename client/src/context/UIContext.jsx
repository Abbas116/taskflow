import { createContext, useContext } from 'react';

// Lets any page open the global "Create project" / "Quick task" modals rendered in AppLayout
export const UIContext = createContext({ openCreateProject: () => {}, openQuickTask: () => {} });
export const useUI = () => useContext(UIContext);

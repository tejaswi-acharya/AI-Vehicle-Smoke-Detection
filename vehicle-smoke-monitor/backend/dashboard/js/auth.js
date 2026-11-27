export const getOfficer = () => sessionStorage.getItem("officer");
export const login = (name) => sessionStorage.setItem("officer", name);
export function logout() { sessionStorage.removeItem("officer"); location.href = "../index.html"; }
export function requireLogin() { if (!getOfficer()) location.href = "../index.html"; }
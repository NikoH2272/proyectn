/* Categorías de Ascensos Rusheo: solo Rusheo y Rusheo FEM. */
(function () {
    const fondo = (id, nombre, color, color2, logo) => ({ id, nombre, corto: nombre.toUpperCase(), color, color2, logo, tipo: 'fondo' });
    window.ASC_CATEGORIAS = [
        fondo('rusheo',    'Rusheo',     '#ff70a6', '#cc3d77', '../imagenes/rusheo.png'),
        fondo('rusheofem', 'Rusheo FEM', '#ffd166', '#cc9900', '../imagenes/rusheo.png'),
    ];
    window.ASC_CATEGORIA = id => window.ASC_CATEGORIAS.find(c => c.id === id)
        || { id: id || 'general', nombre: String(id || 'General').toUpperCase(), corto: String(id || 'GENERAL').toUpperCase(), color: '#9AA0A6', tipo: 'fondo' };
    window.ASC_OPCIONES = (sel, permitidos) => {
        const ok = c => !permitidos || permitidos.includes(c.id);
        const op = c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${c.nombre}</option>`;
        return window.ASC_CATEGORIAS.filter(c => ok(c)).map(op).join('');
    };
    window.ASC_PUNTOS = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 };
    window.ASC_REGLA = { puntos: 45, tags: [3, 4] };
})();

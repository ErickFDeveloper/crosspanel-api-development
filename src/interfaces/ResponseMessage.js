const IResponseMessage = {
    TOKEN: {
        TOKEN_IS_VALID: 'Token válido.',
        TOKEN_IS_INVALID: 'Token inválido.',
    },
    ERROR: {
        UNEXPECTED_ERROR: 'Ocurrió un error inesperado.',
    },
    SYSTEM: {
        COMPLETE_ALL_FIELDS: 'Por favor, llenar todos los campos obligatorios.',
        DATA_SAVED: 'Datos guardados exsitosamente!',
        NOTE_SAVED: 'Nota guardad exsitosamente',
        DELETED: 'Elemento eliminado exsitosamente!'
    },
    REGISTER: {
        FILL_IN_ALL_THE_FIELDS: 'Por favor, llena todos los campos.',
        PASSWORDS_MUST_BE_THE_SAME: 'Las contraseñas deben ser iguales.',
        EMAIL_ALREADY_EXIST: 'Este correo electrónico ya ha sido registrado, intenta con otro.'
    },
    LOGIN: {
        USER_OR_PASSWORD_ARE_INCORRECT: 'Usuario o contraseña incorrectos.',
        PROVIDE_AN_USER_AND_PASSWORD: 'Debes proveer un usuario y una contraseña.',
    },
    USER: {
        CREATED_USER: 'Usuario creado.',
        USER_ALREADY_EXIST: 'Este nombre de usuario ya ha sido registrado, intenta con otro.',
        USER_NOT_EXIST: 'Este usuario no existe.',
        FAILED_CREATING_USER: 'Ocurrió un error creando el usuario.',
    },
    PRODUCT: {
        CREATED_PRODUCT: 'Producto guardado exsitosamente!',
        PRODUCT_DELETED: 'Producto eliminado exsitosamente!'
    },
    SALE: {
        SALE_NO_FOUND: "Error. Venta no encontrada!",
        CLIENT_IS_EMPTY: 'Por favor complete el campo cliente.',
        THE_SALE_NEED_PRODUCTS: 'Error. No puedes crear una venta sin productos!',
        SALE_SAVED: 'Venta guardada exsitosamente!',
        PAID_MORE_AMOUNT: 'No puedes pagar mas del monto total de la venta.',
        ADD_AMOUNT_TO_PAY: 'Por favor agrega un monto a pagar.',
        SALE_STATUS_PAID: 'PAGADA',
        SALE_STATUS_PENDING: 'PENDIENTE',
        SALE_STATUS_ANY_PAY: 'CREDITO',
        SALE_DELETED: 'Venta eliminada exsitosamente!',
        COMPROBANTE_USED: 'Esta secuencia de comprobante ya esta utilizada.',
        REQUIRE_PAYMENT: 'No puedes agregar un pago sin un monto.',
        SELECT_PAYMENT_METHOD: 'Selecciona un metodo de pago.',
        PAY_SUCCESS: 'Pago aplicado exitosamente!',
        PAYMENT_DELETED: 'Pago eliminado exitosamente!',
        SALE_NEED_CLIENT: 'No tienes permitido crear una venta con un cliente anonimo.',
        SALE_NEED_PAY: 'No tienes permitido crear ventas sin pagos.',
        PRODUCT_WITHOUT_QUANTITY: 'No tienes permitido vender productos agotados.',
        NEED_EMAIL: 'Porfavor complete el correo electronico.',
        INVOICE_SEND: 'La factura ha sido enviada exsitosamente!',
        PRODUCT_EXIST: 'El codigo del producto ya existe.'
    },
    INVENTORY: {
        NEED_ESTABLISHMENT: 'Selecciona un establecimiento para buscar los productos.',
        NOT_COMPROBANTE: 'Las secuencias de este comprobante estan agotadas.',
        AMOUNT_REQUIRED: 'Porfavor agrega un monto.',
        CATEGORY_REQUIRED: 'Porfavor agrega una categoria',
        UNEXPECTED_ERROR: 'Ha ocurrido un error al guardar los cambios!'
    },
    CLIENT: {
        CREATED_CLIENT: 'Cliente creado exsitosamente!',
        CLIENT_DELETED: 'Cliente eliminado exsitosamente!',
        MALE: 'Masculino',
        FEMALE: 'Femenino'
    },
    EXPENSE: {
        EXPENSE_DELETED: 'Gasto eliminado exsitosamente!',
        DATE_REQUIRED: 'Selecciona una fecha.'
    },
    PROVIDER: {
        PROVIDER_SAVED: "Proveedor guardado exsitosamente!",
        PROVIDER_DELETED: "Proveedor eliminado exsitosamente!"
    },
    PURCHASE: {
        PROVIDER_REQUIRED: "Selecciona un proveedor",
        ESTABLISHMENT_REQUIRED: "Selecciona un establecimiento",
        PRODUCTS_REQUIRED: "Necesitas agregar productos para realizar una compra",
        CANT_SAVE_PURCHASE: "Hubo un error al guardar la compra",
        PURCHASE_SAVED: "Compra guardada exsitosamente!",
        PURCHASE_DELETED: 'Venta eliminada exsitosamente!',
    }
};

module.exports = IResponseMessage;

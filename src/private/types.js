export const typeInfo = {"short":  {bitSize: 16},
    "byte":  {bitSize: 8}, 
    "unsignedByte":  {bitSize: 8}, 
    "unsignedShort":   {bitSize: 16} , 
    "int":  {bitSize: 32}, 
    "unsignedInt":  {bitSize: 32}, 
    "float":  {bitSize: 32}, 
    "halfFloat":  {bitSize: 16}
};

export const dataViewGetAndSet =  {"short":  {get: 'getInt16',set: 'setInt16'}, 
    "byte":  {get: 'getInt8',set: 'setInt8'}, 
    "unsignedByte":  {get: 'getUint8',set: 'setUint8'}, 
    "unsignedShort":   {get: 'getUint16',set: 'setUint16'} , 
    "int":  {get: 'getInt32',set: 'setInt32'}, 
    "unsignedInt":  {get: 'getUint32',set: 'setUint32'}, 
    "float":  {get: 'getFloat32',set: 'setFloat32'}, 
    "halfFloat":  {get: 'getFloat16',set: 'setFloat16'}
};
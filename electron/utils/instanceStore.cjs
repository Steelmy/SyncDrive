const store = require("../store.cjs");

/**
 * Returns all instances from the store.
 * @returns {Array}
 */
function getInstances() {
  return store.get("instances") || [];
}

/**
 * Finds an instance by ID and returns it with its index.
 * @param {string} instanceId
 * @returns {{ instance: object|null, index: number, instances: Array }}
 */
function findInstance(instanceId) {
  const instances = getInstances();
  const index = instances.findIndex((inst) => inst.id === instanceId);
  return {
    instance: index !== -1 ? instances[index] : null,
    index,
    instances,
  };
}

/**
 * Updates specific fields of an instance and saves to store.
 * @param {string} instanceId
 * @param {object} updates - Key-value pairs to update on the instance.
 * @returns {{ success: boolean, instance?: object, instances?: Array }}
 */
function updateInstance(instanceId, updates) {
  const instances = getInstances();
  const index = instances.findIndex((inst) => inst.id === instanceId);

  if (index === -1) {
    return { success: false };
  }

  Object.assign(instances[index], updates);
  store.set("instances", instances);

  return { success: true, instance: instances[index], instances };
}

/**
 * Saves the full instances array to the store.
 * @param {Array} instances
 */
function saveInstances(instances) {
  store.set("instances", instances);
}

/**
 * Returns the full app config object expected by the renderer.
 * @returns {{ instances: Array, currentInstanceId: string|null, hasCompletedSetup: boolean }}
 */
function getConfig() {
  const instances = getInstances();
  const currentInstanceId = store.get("currentInstanceId");
  return {
    instances,
    currentInstanceId,
    hasCompletedSetup: instances.length > 0,
  };
}

/**
 * Sets the current instance ID.
 * @param {string} instanceId
 */
function setCurrentInstanceId(instanceId) {
  store.set("currentInstanceId", instanceId);
}

/**
 * Gets the current instance ID.
 * @returns {string|null}
 */
function getCurrentInstanceId() {
  return store.get("currentInstanceId");
}

module.exports = {
  getInstances,
  findInstance,
  updateInstance,
  saveInstances,
  getConfig,
  setCurrentInstanceId,
  getCurrentInstanceId,
};

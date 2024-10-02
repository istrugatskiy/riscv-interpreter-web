#include "hash_table.h"
#include <stdlib.h>

uint64_t hash(uint64_t key) { return key % 128; }

hashtable *ht_init(void) {
  hashtable *ht = malloc(sizeof(hashtable));
  for (int i = 0; i < 128; ++i) {
    ht->table[i] = NULL;
  }
  return ht;
}

void ht_insert(hashtable *ht, uint64_t key, uint64_t value) {
  uint64_t index = hash(key);
  node *new_node = malloc(sizeof(node));
  new_node->key = key;
  new_node->value = value;
  new_node->next = ht->table[index];
  ht->table[index] = new_node;
}

uint64_t ht_get(hashtable *ht, uint64_t key) {
  uint64_t index = hash(key);
  node *curr = ht->table[index];
  while (curr != NULL) {
    if (curr->key == key) {
      return curr->value;
    }
    curr = curr->next;
  }
  return 0;
}

void ht_free(hashtable *ht) {
  if (ht == NULL) {
    return;
  }

  for (int i = 0; i < 128; ++i) {
    node *curr = ht->table[i];
    while (curr != NULL) {
      node *temp = curr;
      curr = curr->next;
      free(temp);
    }
  }

  free(ht);
}

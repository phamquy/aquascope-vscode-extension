import * as assert from 'assert';
import { chooseColumn } from '../../analysis/target';

suite('choosing the editor a title-bar run analyses (feature 006 D4)', () => {
  test('one editor shows the document: that one, whatever the record says', () => {
    assert.strictEqual(chooseColumn([2], undefined), 2);
    assert.strictEqual(chooseColumn([2], 1), 2);
  });

  test('several show it: the column it was last focused in', () => {
    assert.strictEqual(chooseColumn([1, 2, 3], 2), 2);
    assert.strictEqual(chooseColumn([3, 1], 3), 3);
  });

  test('several show it and the record is missing or stale: the lowest column', () => {
    assert.strictEqual(chooseColumn([3, 2], undefined), 2);
    assert.strictEqual(chooseColumn([3, 2], 1), 2);
  });

  test('none shows it: no column', () => {
    assert.strictEqual(chooseColumn([], 1), undefined);
  });
});

import type { DMMF } from '@prisma/generator-helper';
import { isAnnotatedWith } from './field-classifiers';
import { DTO_CAST_TYPE } from './annotations';

describe('field-classifiers', () => {
  describe('isAnnotatedWith', () => {
    const mockDmmfAnnotation = (
      annotation: string,
    ): Pick<DMMF.Field, 'documentation'> => ({
      documentation: `/// @OneAnnotation\n/// Some Commentary about this annotation\n/// DTOCastType\n/// ${annotation}`,
    });

    it('returns false not annotated and no params requested', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('not the right annotation'),
          DTO_CAST_TYPE,
        ),
      ).toStrictEqual(false);
    });

    it('returns false not annotated even if params requested', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('not the right annotation'),
          DTO_CAST_TYPE,
          { returnAnnotationParameters: true },
        ),
      ).toStrictEqual(false);
    });

    it('returns true if no params requested', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('@DtoCastType(MyType, ../types, default)'),
          DTO_CAST_TYPE,
        ),
      ).toStrictEqual(true);
    });

    it('returns params if requested', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('@DtoCastType(MyType, ../types, default)'),
          DTO_CAST_TYPE,
          { returnAnnotationParameters: true },
        ),
      ).toStrictEqual('MyType, ../types, default');
    });

    it('does not return params if invalid', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('@DtoCastType(MyType!!!!!, ../types, default)'),
          DTO_CAST_TYPE,
          { returnAnnotationParameters: true },
        ),
      ).toStrictEqual('');
    });

    it('returns params with generic type', () => {
      expect(
        isAnnotatedWith(
          mockDmmfAnnotation('@DtoCastType(MyType<any>, ../types, default)'),
          DTO_CAST_TYPE,
          { returnAnnotationParameters: true },
        ),
      ).toStrictEqual('MyType<any>, ../types, default');
    });
  });
});

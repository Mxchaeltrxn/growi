import { Schema, Types, Model } from 'mongoose';

import mongoosePaginate from 'mongoose-paginate-v2';
import uniqueValidator from 'mongoose-unique-validator';

import { getOrCreateModel } from '../util/mongoose-utils';

export interface IShareLink {
  _id: Types.ObjectId;
  relatedPage: Types.ObjectId;
  expiredAt: Date;
  description: string;
  createdAt: Date;
}

/*
 * define schema
 */
const schema = new Schema({
  relatedPage: {
    type: Types.ObjectId,
    ref: 'Page',
    required: true,
    index: true,
  },
  expiredAt: { type: Date },
  description: { type: String },
  createdAt: { type: Date, default: Date.now, required: true },
});
schema.plugin(mongoosePaginate);
schema.plugin(uniqueValidator);


class ShareLink extends Model {

  isExpired() {
    if (this.expiredAt == null) {
      return false;
    }
    return this.expiredAt.getTime() < new Date().getTime();
  }

}

schema.loadClass(ShareLink);
export default getOrCreateModel<IShareLink>('ShareLink', schema);
